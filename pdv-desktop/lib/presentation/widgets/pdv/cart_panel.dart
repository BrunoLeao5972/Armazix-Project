import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency.dart';
import '../../cubit/cart/cart_cubit.dart';
import '../../cubit/cart/cart_state.dart';
import 'cart_item_tile.dart';

const _paymentMethods = [
  ('cash', 'Dinheiro'),
  ('pix', 'PIX'),
  ('card', 'Crédito'),
  ('debit', 'Débito'),
];

class CartPanel extends StatefulWidget {
  final CartState cart;
  final ValueChanged<String> onFinalize;
  final bool finalizing;

  const CartPanel({super.key, required this.cart, required this.onFinalize, required this.finalizing});

  @override
  State<CartPanel> createState() => _CartPanelState();
}

class _CartPanelState extends State<CartPanel> {
  String? _paymentMethod;
  bool _showDiscount = false;
  final _discountController = TextEditingController(text: '0,00');

  @override
  void dispose() {
    _discountController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant CartPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Carrinho esvaziou (venda finalizada) — solta a forma de pagamento
    // selecionada pra próxima venda começar limpa.
    if (oldWidget.cart.lines.isNotEmpty && widget.cart.lines.isEmpty) {
      _paymentMethod = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final cartCubit = context.read<CartCubit>();
    return Container(
      width: 360,
      color: Colors.white,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))),
            child: const Text('COMANDA', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.inkMuted, letterSpacing: 0.5)),
          ),
          Expanded(
            child: widget.cart.lines.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.shopping_bag_outlined, size: 36, color: AppColors.border),
                        SizedBox(height: 8),
                        Text('Toque em um produto para adicionar', style: TextStyle(color: AppColors.inkMuted, fontSize: 12)),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    itemCount: widget.cart.lines.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.border),
                    itemBuilder: (context, i) {
                      final line = widget.cart.lines[i];
                      return CartItemTile(
                        line: line,
                        onQuantityChange: (q) => cartCubit.updateQuantity(line.productId, q),
                        onRemove: () => cartCubit.removeLine(line.productId),
                      );
                    },
                  ),
          ),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.border))),
            child: Column(
              children: [
                if (_showDiscount)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _discountController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(isDense: true, hintText: '0,00'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () {
                            final value = double.tryParse(_discountController.text.replaceAll(',', '.')) ?? 0;
                            cartCubit.setDiscount(value);
                            setState(() => _showDiscount = false);
                          },
                          child: const Text('Aplicar'),
                        ),
                      ],
                    ),
                  ),
                OutlinedButton.icon(
                  onPressed: () => setState(() => _showDiscount = !_showDiscount),
                  icon: const Icon(Icons.percent, size: 14),
                  label: const Text('Aplicar desconto'),
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(36)),
                ),
                const SizedBox(height: 12),
                _SummaryRow('Subtotal', Currency.format(widget.cart.subtotal)),
                if (widget.cart.discount > 0)
                  _SummaryRow('Desconto', '− ${Currency.format(widget.cart.discount)}', color: AppColors.danger),
                const Divider(color: AppColors.border),
                _SummaryRow('Total', Currency.format(widget.cart.total), bold: true),
                const SizedBox(height: 12),
                Row(
                  children: [
                    for (final pm in _paymentMethods)
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: _PaymentChip(
                            label: pm.$2,
                            active: _paymentMethod == pm.$1,
                            onTap: () => setState(() => _paymentMethod = pm.$1),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: (widget.cart.lines.isEmpty || _paymentMethod == null || widget.finalizing)
                      ? null
                      : () => widget.onFinalize(_paymentMethod!),
                  child: widget.finalizing
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('Finalizar Venda — ${Currency.format(widget.cart.total)}'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: widget.cart.lines.isEmpty
                      ? null
                      : () {
                          cartCubit.clear();
                          setState(() => _paymentMethod = null);
                        },
                  child: const Text('Cancelar venda', style: TextStyle(color: AppColors.danger, fontSize: 12)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  final Color? color;
  const _SummaryRow(this.label, this.value, {this.bold = false, this.color});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(fontSize: bold ? 15 : 13, fontWeight: bold ? FontWeight.bold : FontWeight.normal, color: bold ? AppColors.ink : AppColors.inkMuted)),
            Text(value, style: TextStyle(fontSize: bold ? 15 : 13, fontWeight: bold ? FontWeight.bold : FontWeight.w600, color: color ?? AppColors.ink)),
          ],
        ),
      );
}

class _PaymentChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _PaymentChip({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) => Material(
        color: active ? AppColors.primary : Colors.white,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Container(
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), border: Border.all(color: active ? AppColors.primary : AppColors.border)),
            child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: active ? Colors.white : AppColors.ink)),
          ),
        ),
      );
}
