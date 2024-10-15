export class CreateUserDto {
  name: string;
  cpf_cnpj: string;
  email: string;
  password: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}
