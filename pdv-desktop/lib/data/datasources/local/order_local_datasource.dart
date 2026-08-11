import 'package:isar/isar.dart';
import '../../models/order_model.dart';

abstract class OrderLocalDataSource {
  Future<OrderModel> insert(OrderModel order);
  Future<List<OrderModel>> pending();
  Future<void> markSynced(String localCode, {required String remoteOrderId, required int remoteNumber});
  Future<void> markFailed(String localCode, String error);
  Stream<int> watchPendingCount(String storeId);
}

class OrderLocalDataSourceImpl implements OrderLocalDataSource {
  final Isar isar;
  const OrderLocalDataSourceImpl(this.isar);

  @override
  Future<OrderModel> insert(OrderModel order) async {
    await isar.writeTxn(() async {
      await isar.orderModels.put(order);
    });
    return order;
  }

  @override
  Future<List<OrderModel>> pending() {
    return isar.orderModels.filter().isSyncedEqualTo(false).sortByCreatedAt().findAll();
  }

  @override
  Future<void> markSynced(String localCode, {required String remoteOrderId, required int remoteNumber}) async {
    await isar.writeTxn(() async {
      final order = await isar.orderModels.filter().localCodeEqualTo(localCode).findFirst();
      if (order == null) return;
      order
        ..isSynced = true
        ..remoteOrderId = remoteOrderId
        ..remoteNumber = remoteNumber
        ..syncError = null;
      await isar.orderModels.put(order);
    });
  }

  @override
  Future<void> markFailed(String localCode, String error) async {
    await isar.writeTxn(() async {
      final order = await isar.orderModels.filter().localCodeEqualTo(localCode).findFirst();
      if (order == null) return;
      order
        ..syncError = error
        ..syncAttempts = order.syncAttempts + 1;
      await isar.orderModels.put(order);
    });
  }

  @override
  Stream<int> watchPendingCount(String storeId) {
    return isar.orderModels
        .filter()
        .storeIdEqualTo(storeId)
        .isSyncedEqualTo(false)
        .watch(fireImmediately: true)
        .map((list) => list.length);
  }
}
