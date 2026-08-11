import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';

abstract class CatalogRemoteDataSource {
  Future<List<Map<String, dynamic>>> fetchProducts();
  Future<List<Map<String, dynamic>>> fetchCategories();
}

class CatalogRemoteDataSourceImpl implements CatalogRemoteDataSource {
  final ApiClient client;
  const CatalogRemoteDataSourceImpl(this.client);

  @override
  Future<List<Map<String, dynamic>>> fetchProducts() async {
    final data = await client.get(ApiConstants.productsListAdmin, query: {'scope': 'pdv'});
    return (data['products'] as List).cast<Map<String, dynamic>>();
  }

  @override
  Future<List<Map<String, dynamic>>> fetchCategories() async {
    final data = await client.get(ApiConstants.categoriesListAdmin);
    return (data['categories'] as List).cast<Map<String, dynamic>>();
  }
}
