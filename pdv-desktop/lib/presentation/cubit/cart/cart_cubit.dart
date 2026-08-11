import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/utils/currency.dart';
import '../../../domain/entities/product_entity.dart';
import 'cart_state.dart';

class CartCubit extends Cubit<CartState> {
  CartCubit() : super(const CartState());

  void addProduct(ProductEntity product) {
    final index = state.lines.indexWhere((l) => l.productId == product.remoteId);
    if (index >= 0) {
      final updated = [...state.lines];
      updated[index] = updated[index].copyWith(quantity: updated[index].quantity + 1);
      emit(state.copyWith(lines: updated));
      return;
    }
    emit(state.copyWith(lines: [
      ...state.lines,
      CartLine(
        productId: product.remoteId,
        name: product.name,
        emoji: product.emoji,
        unitPrice: Currency.parse(product.price),
        quantity: 1,
      ),
    ]));
  }

  void updateQuantity(String productId, int quantity) {
    if (quantity <= 0) {
      removeLine(productId);
      return;
    }
    final updated = state.lines
        .map((l) => l.productId == productId ? l.copyWith(quantity: quantity) : l)
        .toList();
    emit(state.copyWith(lines: updated));
  }

  void removeLine(String productId) {
    emit(state.copyWith(lines: state.lines.where((l) => l.productId != productId).toList()));
  }

  void setDiscount(double value) => emit(state.copyWith(discount: value));

  void clear() => emit(const CartState());
}
