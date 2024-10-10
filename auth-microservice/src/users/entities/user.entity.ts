import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
} from 'class-validator';

export class User {
  @IsNotEmpty()
  name: string;

  @IsPhoneNumber(null)
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @Length(8, 20)
  password: string;

  @IsNotEmpty()
  address: string;

  @IsNotEmpty()
  city: string;

  @IsNotEmpty()
  state: string;

  @IsNotEmpty()
  postal_code: string;

  @IsOptional()
  token_expires_at?: Date;

  @IsOptional()
  is_company?: boolean;

  @IsNotEmpty()
  @IsString()
  cpf_cnpj: string;

  @IsOptional()
  created_at?: Date;

  @IsOptional()
  updated_at?: Date;
}
