import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';

class LoginRemoteResult {
  final String token;
  final String userId;
  final String name;
  final String email;
  final String role;
  final String storeId;
  final String storeName;
  final String storeSlug;

  const LoginRemoteResult({
    required this.token,
    required this.userId,
    required this.name,
    required this.email,
    required this.role,
    required this.storeId,
    required this.storeName,
    required this.storeSlug,
  });
}

abstract class AuthRemoteDataSource {
  Future<LoginRemoteResult> login(String email, String password);
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final ApiClient client;
  const AuthRemoteDataSourceImpl(this.client);

  @override
  Future<LoginRemoteResult> login(String email, String password) async {
    final data = await client.post(ApiConstants.loginDesktop, {'email': email, 'password': password});
    final user = data['user'] as Map<String, dynamic>;
    final store = data['store'] as Map<String, dynamic>?;
    return LoginRemoteResult(
      token: data['token'] as String,
      userId: user['id'] as String,
      name: user['name'] as String,
      email: user['email'] as String,
      role: user['role'] as String,
      storeId: store?['id'] as String? ?? '',
      storeName: store?['name'] as String? ?? '',
      storeSlug: store?['slug'] as String? ?? '',
    );
  }
}
