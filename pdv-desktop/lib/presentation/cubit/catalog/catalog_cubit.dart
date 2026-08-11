import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../domain/entities/category_entity.dart';
import '../../../domain/entities/product_entity.dart';
import '../../../domain/repositories/catalog_repository.dart';
import 'catalog_state.dart';

class CatalogCubit extends Cubit<CatalogState> {
  static const String all = 'all';
  static const String favorites = 'favorites';

  final CatalogRepository repository;
  final String storeId;

  StreamSubscription<List<CategoryEntity>>? _categoriesSub;
  StreamSubscription<List<ProductEntity>>? _productsSub;
  Timer? _debounce;

  CatalogCubit({required this.repository, required this.storeId}) : super(const CatalogState()) {
    _categoriesSub = repository.watchCategories(storeId).listen((cats) {
      emit(state.copyWith(categories: cats));
    });
    _watchProducts();
  }

  void _watchProducts() {
    _productsSub?.cancel();
    _productsSub = repository
        .watchProducts(
          storeId,
          categoryId: _categoryIdOrNull(),
          onlyFeatured: state.activeCategoryId == favorites,
        )
        .listen((products) => emit(state.copyWith(products: products, loading: false)));
  }

  String? _categoryIdOrNull() {
    if (state.activeCategoryId == all || state.activeCategoryId == favorites) return null;
    return state.activeCategoryId;
  }

  void selectCategory(String categoryId) {
    emit(state.copyWith(activeCategoryId: categoryId, searchTerm: '', loading: true));
    _watchProducts();
  }

  void search(String term) {
    emit(state.copyWith(searchTerm: term));
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      if (term.trim().isEmpty) {
        _watchProducts();
        return;
      }
      _productsSub?.cancel();
      final results = await repository.searchProducts(storeId, term.trim());
      emit(state.copyWith(products: results, loading: false));
    });
  }

  @override
  Future<void> close() {
    _categoriesSub?.cancel();
    _productsSub?.cancel();
    _debounce?.cancel();
    return super.close();
  }
}
