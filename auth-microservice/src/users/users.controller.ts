import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @MessagePattern('create_user')
  create(@Payload() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @MessagePattern('find_all_user')
  findAll() {
    return this.userService.findAll();
  }

  @MessagePattern('find_one_user')
  findOne(@Payload() id: string) {
    return this.userService.findOne(id);
  }

  @MessagePattern('update_user')
  update(@Payload() updateUserDto: UpdateUserDto) {
    return this.userService.update(updateUserDto.id, updateUserDto);
  }

  @MessagePattern('remove_user')
  remove(@Payload() id: string) {
    return this.userService.remove(id);
  }
}
