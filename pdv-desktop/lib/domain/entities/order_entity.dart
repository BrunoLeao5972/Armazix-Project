import 'package:equatable/equatable.dart';

class OrderItemEntity extends Equatable {
  final String? productId;
  final String productName;
  final String? productEmoji;
  final int quantity;
  final String unitPrice;
  final String total;

  const OrderItemEntity({
    this.productId,
    required this.productName,
    this.productEmoji,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'productName': productName,
        'productEmoji': productEmoji,
        'quantity': quantity,
        'unitPrice': unitPrice,
        'total': total,
      };

  @override
  List<Object?> get props => [productId, quantity, total];
}

/// Uma venda do PDV — sempre gravada localmente primeiro (localCode é a
/// identidade real, gerada no cliente), sincronizada com o servidor depois.
class OrderEntity extends Equatable {
  final String localCode;
  final String storeId;
  final String sessaoId;
  final String? mesaLabel;
  final String paymentMethod;
  final int? installments;
  final List<OrderItemEntity> items;
  final String subtotal;
  final String? discount;
  final String total;
  final DateTime createdAt;
  final bool isSynced;
  final String? remoteOrderId;
  final int? remoteNumber;
  final String? syncError;

  const OrderEntity({
    required this.localCode,
    required this.storeId,
    required this.sessaoId,
    this.mesaLabel,
    required this.paymentMethod,
    this.installments,
    required this.items,
    required this.subtotal,
    this.discount,
    required this.total,
    required this.createdAt,
    this.isSynced = false,
    this.remoteOrderId,
    this.remoteNumber,
    this.syncError,
  });

  Map<String, dynamic> toSyncPayload() => {
        'sessaoId': sessaoId,
        if (mesaLabel != null) 'mesaLabel': mesaLabel,
        'paymentMethod': paymentMethod,
        if (installments != null) 'installments': installments,
        'items': items.map((i) => i.toJson()).toList(),
        'subtotal': subtotal,
        if (discount != null) 'discount': discount,
        'total': total,
      };

  @override
  List<Object?> get props => [localCode, isSynced, total];
}
