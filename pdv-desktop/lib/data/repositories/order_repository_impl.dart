import 'dart:async';
import 'package:dartz/dartz.dart';
import '../../core/error/exceptions.dart';
import '../../core/error/failures.dart';
import '../../core/network/network_info.dart';
import '../../domain/entities/order_entity.dart';
import '../../domain/repositories/order_repository.dart';
import '../datasources/local/order_local_datasource.dart';
import '../datasources/remote/pdv_remote_datasource.dart';
import '../models/order_model.dart';

class OrderRepositoryImpl implements OrderRepository {
  final OrderLocalDataSource local;
  final PdvRemoteDataSource remote;
  final NetworkInfo networkInfo;

  bool _draining = false;

  OrderRepositoryImpl({required this.local, required this.remote, required this.networkInfo});

  @override
  Future<OrderEntity> enqueueSale(OrderEntity order) async {
    final model = OrderModel.fromEntity(order);
    await local.insert(model);
    // Já tenta sincronizar na hora se tiver conexão — não espera o próximo
    // tick do monitor de rede pra dar a sensação de "vendeu, já sincronizou".
    unawaited(drainQueue());
    return model.toEntity();
  }

  @override
  Stream<int> watchPendingCount(String storeId) => local.watchPendingCount(storeId);

  @override
  Future<Either<Failure, DrainResult>> drainQueue() async {
    if (_draining || !networkInfo.isOnline.value) {
      return const Right((synced: 0, failed: 0));
    }
    _draining = true;
    var synced = 0;
    var failed = 0;
    try {
      final pending = await local.pending();
      for (final order in pending) {
        try {
          final result = await remote.finalizarVenda(order.toEntity().toSyncPayload());
          await local.markSynced(order.localCode, remoteOrderId: result.orderId, remoteNumber: result.number);
          synced++;
        } on NetworkException {
          // Perdeu conexão no meio da fila — para por aqui, tenta de novo na
          // próxima janela de conectividade em vez de falhar tudo que resta.
          break;
        } on ServerException catch (e) {
          await local.markFailed(order.localCode, e.message);
          failed++;
        }
      }
      return Right((synced: synced, failed: failed));
    } finally {
      _draining = false;
    }
  }
}
