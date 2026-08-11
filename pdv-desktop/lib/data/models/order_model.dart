import 'package:isar/isar.dart';
import '../../domain/entities/order_entity.dart';

part 'order_model.g.dart';

@embedded
class OrderItemEmbedded {
  String? productId;
  String productName = '';
  String? productEmoji;
  int quantity = 0;
  String unitPrice = '0.00';
  String total = '0.00';

  OrderItemEntity toEntity() => OrderItemEntity(
        productId: productId,
        productName: productName,
        productEmoji: productEmoji,
        quantity: quantity,
        unitPrice: unitPrice,
        total: total,
      );

  static OrderItemEmbedded fromEntity(OrderItemEntity e) => OrderItemEmbedded()
    ..productId = e.productId
    ..productName = e.productName
    ..productEmoji = e.productEmoji
    ..quantity = e.quantity
    ..unitPrice = e.unitPrice
    ..total = e.total;
}

@collection
class OrderModel {
  Id id = Isar.autoIncrement;

  /// Identidade real da venda — gerada no cliente, existe mesmo antes de
  /// sincronizar. O id remoto (número do pedido) só existe depois.
  @Index(unique: true, replace: true)
  late String localCode;

  @Index()
  late String storeId;

  late String sessaoId;
  String? mesaLabel;
  late String paymentMethod;
  int? installments;
  List<OrderItemEmbedded> items = [];
  late String subtotal;
  String? discount;
  late String total;
  late DateTime createdAt;

  @Index()
  bool isSynced = false;

  String? remoteOrderId;
  int? remoteNumber;
  String? syncError;
  int syncAttempts = 0;

  OrderEntity toEntity() => OrderEntity(
        localCode: localCode,
        storeId: storeId,
        sessaoId: sessaoId,
        mesaLabel: mesaLabel,
        paymentMethod: paymentMethod,
        installments: installments,
        items: items.map((i) => i.toEntity()).toList(),
        subtotal: subtotal,
        discount: discount,
        total: total,
        createdAt: createdAt,
        isSynced: isSynced,
        remoteOrderId: remoteOrderId,
        remoteNumber: remoteNumber,
        syncError: syncError,
      );

  static OrderModel fromEntity(OrderEntity e) => OrderModel()
    ..localCode = e.localCode
    ..storeId = e.storeId
    ..sessaoId = e.sessaoId
    ..mesaLabel = e.mesaLabel
    ..paymentMethod = e.paymentMethod
    ..installments = e.installments
    ..items = e.items.map(OrderItemEmbedded.fromEntity).toList()
    ..subtotal = e.subtotal
    ..discount = e.discount
    ..total = e.total
    ..createdAt = e.createdAt
    ..isSynced = e.isSynced
    ..remoteOrderId = e.remoteOrderId
    ..remoteNumber = e.remoteNumber
    ..syncError = e.syncError;
}
