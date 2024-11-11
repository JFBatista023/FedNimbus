import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
} from 'class-validator';

export class UpdateUserDto {
  @IsNotEmpty()
  id: string;

  @IsNotEmpty()
  idFromToken: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsPhoneNumber(null)
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsOptional()
  @Length(8, 20)
  password?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  cpf_cnpj?: string;
}
