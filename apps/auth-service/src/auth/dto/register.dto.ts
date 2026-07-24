import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum RegisterRole {
  buyer = 'buyer',
  seller = 'seller',
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  // No exponemos 'admin' aquí a propósito: los admins se crean por seed
  // o por un endpoint interno protegido, nunca desde el registro público.
  @IsOptional()
  @IsEnum(RegisterRole)
  role?: RegisterRole;
}
