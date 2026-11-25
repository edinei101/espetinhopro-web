import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Informe o usuário ou e-mail.' })
  @IsString()
  login!: string;

  @IsNotEmpty({ message: 'Informe a senha.' })
  @IsString()
  senha!: string;
}