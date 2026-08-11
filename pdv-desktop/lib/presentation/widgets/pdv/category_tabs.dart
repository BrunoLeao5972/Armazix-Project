import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../domain/entities/category_entity.dart';
import '../../cubit/catalog/catalog_cubit.dart';

class CategoryTabs extends StatelessWidget {
  final List<CategoryEntity> categories;
  final String activeId;
  final ValueChanged<String> onSelect;

  const CategoryTabs({super.key, required this.categories, required this.activeId, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _Tab(
            label: 'Favoritos',
            icon: Icons.star_rounded,
            active: activeId == CatalogCubit.favorites,
            onTap: () => onSelect(CatalogCubit.favorites),
          ),
          const SizedBox(width: 8),
          _Tab(label: 'Todos', active: activeId == CatalogCubit.all, onTap: () => onSelect(CatalogCubit.all)),
          for (final c in categories) ...[
            const SizedBox(width: 8),
            _Tab(label: c.name, emoji: c.emoji, active: activeId == c.remoteId, onTap: () => onSelect(c.remoteId)),
          ],
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final IconData? icon;
  final String? emoji;
  final bool active;
  final VoidCallback onTap;

  const _Tab({required this.label, this.icon, this.emoji, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.primary : Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? AppColors.primary : AppColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) Icon(icon, size: 14, color: active ? Colors.white : AppColors.inkMuted),
              if (emoji != null) Text(emoji!, style: const TextStyle(fontSize: 14)),
              if (icon != null || emoji != null) const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: active ? Colors.white : AppColors.ink)),
            ],
          ),
        ),
      ),
    );
  }
}
