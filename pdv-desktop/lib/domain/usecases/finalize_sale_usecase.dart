import '../entities/order_entity.dart';
import '../repositories/order_repository.dart';

class FinalizeSaleUseCase {
  final OrderRepository repository;
  const FinalizeSaleUseCase(this.repository);

  /// Grava a venda local (sempre funciona, online ou offline) e já dispara
  /// uma tentativa de sincronização em background se houver conexão.
  Future<OrderEntity> call(OrderEntity order) => repository.enqueueSale(order);
}
