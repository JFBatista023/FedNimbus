import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firestore } from 'src/infra/firebase/firebase.config';
import { validateCNPJ, validateCPF, validateEmail } from 'validations-br';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private usersCollection = collection(firestore, 'users');

  constructor(private jwtService: JwtService) {}

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;
    const q = query(this.usersCollection, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new RpcException({
        message: 'User not found.',
        statusCode: 404,
      });
    }

    const user = querySnapshot.docs[0].data();

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new RpcException({
        message: 'Credentials are wrong.',
        statusCode: 401,
      });
    }

    const payload = { email: user.email, sub: user.id };
    const access_token = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });
    const refresh_token = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      access_token,
      refresh_token,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken);

      const newAccessToken = this.jwtService.sign(
        { email: payload.email, sub: payload.sub },
        { expiresIn: '1h' },
      );

      return {
        access_token: newAccessToken,
      };
    } catch (error) {
      throw new RpcException({
        message: 'Invalid refresh token.',
        statusCode: 401,
      });
    }
  }

  async create(createUserDto: CreateUserDto) {
    const { cpf_cnpj, email, password, ...rest } = createUserDto;
    const q = query(
      this.usersCollection,
      or(where('cpf_cnpj', '==', cpf_cnpj), where('email', '==', email)),
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      throw new RpcException({
        message: 'User with CPF/CNPJ or e-mail already exists.',
        statusCode: 404,
      });
    }

    if (!validateCNPJ(cpf_cnpj) && !validateCPF(cpf_cnpj)) {
      throw new RpcException({
        message: 'Invalid CPF/CNPJ.',
        statusCode: 404,
      });
    }

    if (!validateEmail(email)) {
      throw new RpcException({
        message: 'Invalid e-mail.',
        statusCode: 404,
      });
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
    const docRef = doc(firestore, 'users', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new RpcException({
        message: 'User not found.',
        statusCode: 404,
      });
    }

    const userData = docSnap.data();

    return {
      id: docSnap.id,
      ...userData,
      created_at:
        userData.created_at instanceof Timestamp
          ? userData.created_at.toDate().toISOString()
          : userData.created_at,
      updated_at:
        userData.updated_at instanceof Timestamp
          ? userData.updated_at.toDate().toISOString()
          : userData.updated_at,
    };
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
