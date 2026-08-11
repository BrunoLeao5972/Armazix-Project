import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';
import '../entities/order_entity.dart';

typedef DrainResult = ({int synced, int failed});

abstract class OrderRepository {
  /// Grava a venda local primeiro (isSynced=false) — nunca falha por causa
  /// de rede, porque não depende dela.
  Future<OrderEntity> enqueueSale(OrderEntity order);

  Stream<int> watchPendingCount(String storeId);

  /// Reenvia toda venda pendente pra API. Uma falha numa não trava as outras.
  Future<Either<Failure, DrainResult>> drainQueue();
}
