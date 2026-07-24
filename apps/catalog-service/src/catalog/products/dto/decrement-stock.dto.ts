import { IsInt, IsPositive } from 'class-validator';

export class DecrementStockDto {
  @IsInt()
  @IsPositive()
  quantity!: number;
}
