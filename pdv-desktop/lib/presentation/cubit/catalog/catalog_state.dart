import 'package:equatable/equatable.dart';
import '../../../domain/entities/category_entity.dart';
import '../../../domain/entities/product_entity.dart';

class CatalogState extends Equatable {
  final List<CategoryEntity> categories;
  final List<ProductEntity> products;
  final String activeCategoryId;
  final String searchTerm;
  final bool loading;

  const CatalogState({
    this.categories = const [],
    this.products = const [],
    this.activeCategoryId = 'all',
    this.searchTerm = '',
    this.loading = true,
  });

  CatalogState copyWith({
    List<CategoryEntity>? categories,
    List<ProductEntity>? products,
    String? activeCategoryId,
    String? searchTerm,
    bool? loading,
  }) {
    return CatalogState(
      categories: categories ?? this.categories,
      products: products ?? this.products,
      activeCategoryId: activeCategoryId ?? this.activeCategoryId,
      searchTerm: searchTerm ?? this.searchTerm,
      loading: loading ?? this.loading,
    );
  }

  @override
  List<Object?> get props => [categories, products, activeCategoryId, searchTerm, loading];
}
