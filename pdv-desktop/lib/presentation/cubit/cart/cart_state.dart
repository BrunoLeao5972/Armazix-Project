import 'package:equatable/equatable.dart';

class CartLine extends Equatable {
  final String productId;
  final String name;
  final String? emoji;
  final double unitPrice;
  final int quantity;

  const CartLine({
    required this.productId,
    required this.name,
    this.emoji,
    required this.unitPrice,
    required this.quantity,
  });

  double get total => unitPrice * quantity;

  CartLine copyWith({int? quantity}) => CartLine(
        productId: productId,
        name: name,
        emoji: emoji,
        unitPrice: unitPrice,
        quantity: quantity ?? this.quantity,
      );

  @override
  List<Object?> get props => [productId, quantity, unitPrice];
}

class CartState extends Equatable {
  final List<CartLine> lines;
  final double discount;

  const CartState({this.lines = const [], this.discount = 0});

  double get subtotal => lines.fold<double>(0, (sum, l) => sum + l.total);
  double get total => (subtotal - discount).clamp(0, double.infinity);

  CartState copyWith({List<CartLine>? lines, double? discount}) => CartState(
        lines: lines ?? this.lines,
        discount: discount ?? this.discount,
      );

  @override
  List<Object?> get props => [lines, discount];
}
