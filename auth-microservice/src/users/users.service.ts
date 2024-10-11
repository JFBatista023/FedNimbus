import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  or,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firestore } from 'src/infra/firebase/firebase.config';
import { validateCNPJ, validateCPF, validateEmail } from 'validations-br';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private usersCollection = collection(firestore, 'users');

  async create(createUserDto: CreateUserDto) {
    const { cpf_cnpj, email, password, ...rest } = createUserDto;
    const q = query(
      this.usersCollection,
      or(where('cpf_cnpj', '==', cpf_cnpj), where('email', '==', email)),
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      throw new BadRequestException(
        'User with CPF/CNPJ or e-mail already exists.',
      );
    }

    if (!validateCNPJ(cpf_cnpj) && !validateCPF(cpf_cnpj)) {
      throw new BadRequestException('Invalid CPF/CNPJ.');
    }

    if (!validateEmail(email)) {
      throw new BadRequestException('Invalid e-mail.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      ...rest,
      email: email.toLowerCase(),
      cpf_cnpj,
      password: hashedPassword,
      is_company: cpf_cnpj.length === 14,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const docRef = await addDoc(this.usersCollection, newUser);
    return { id: docRef.id, ...newUser };
  }

  async findAll() {
    const usersCollection = await getDocs(this.usersCollection);
    const users = usersCollection.docs.map(user => ({
      id: user.id,
      ...user.data(),
    }));

    return users;
  }

  async findOne(id: string) {
    const q = query(this.usersCollection, where('id', '==', id));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new RpcException({
        message: 'User not found.',
        statusCode: 404,
      });
    }

    const user = querySnapshot.docs[0];
    return { id: user.id, ...user.data() };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const userRef = doc(firestore, 'users', id);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      throw new NotFoundException('User not found.');
    }

    const updatedUser = {
      ...updateUserDto,
      updated_at: new Date(),
    };

    await updateDoc(userRef, updatedUser);
    return { id, ...updatedUser };
  }

  async remove(id: string) {
    const userRef = doc(firestore, 'users', id);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      throw new NotFoundException('User not found.');
    }

    await deleteDoc(userRef);
    return { message: 'User successfully deleted.' };
  }
}
