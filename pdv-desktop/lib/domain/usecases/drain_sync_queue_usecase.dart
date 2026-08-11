import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';
import '../repositories/order_repository.dart';

class DrainSyncQueueUseCase {
  final OrderRepository repository;
  const DrainSyncQueueUseCase(this.repository);

  Future<Either<Failure, DrainResult>> call() => repository.drainQueue();
}
