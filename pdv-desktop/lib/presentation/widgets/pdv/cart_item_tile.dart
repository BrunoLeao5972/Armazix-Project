import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency.dart';
import '../../cubit/cart/cart_state.dart';

class CartItemTile extends StatelessWidget {
  final CartLine line;
  final ValueChanged<int> onQuantityChange;
  final VoidCallback onRemove;

  const CartItemTile({super.key, required this.line, required this.onQuantityChange, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(8)),
            alignment: Alignment.center,
            child: Text(line.emoji ?? '📦', style: const TextStyle(fontSize: 16)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(line.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                Text('${Currency.format(line.unitPrice)} / un', style: const TextStyle(fontSize: 11, color: AppColors.inkMuted)),
              ],
            ),
          ),
          Container(
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(8)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  iconSize: 14,
                  visualDensity: VisualDensity.compact,
                  onPressed: () => onQuantityChange(line.quantity - 1),
                  icon: const Icon(Icons.remove),
                ),
                SizedBox(
                  width: 20,
                  child: Text('${line.quantity}', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                ),
                IconButton(
                  iconSize: 14,
                  visualDensity: VisualDensity.compact,
                  onPressed: () => onQuantityChange(line.quantity + 1),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 70,
            child: Text(Currency.format(line.total), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          ),
          IconButton(
            iconSize: 16,
            visualDensity: VisualDensity.compact,
            onPressed: onRemove,
            icon: const Icon(Icons.close, color: AppColors.inkMuted),
          ),
        ],
      ),
    );
  }
}
