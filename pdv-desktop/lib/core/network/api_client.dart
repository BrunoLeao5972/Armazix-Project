import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../error/exceptions.dart';

/// Cliente HTTP fino pra API Cloud do Armazix. Autenticação via Bearer —
/// setToken() é chamado pelo AuthRepository depois do login/restauração de
/// sessão; todo request subsequente já sai com o header certo.
class ApiClient {
  late final Dio dio;
  String? _token;

  ApiClient() {
    dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      headers: {'content-type': 'application/json'},
    ));

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_token != null) {
            options.headers['Authorization'] = 'Bearer $_token';
          }
          handler.next(options);
        },
      ),
    );
  }

  void setToken(String? token) => _token = token;

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) async {
    try {
      final res = await dio.get<Map<String, dynamic>>(path, queryParameters: query);
      return res.data ?? {};
    } on DioException catch (e) {
      throw _translate(e);
    }
  }

  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) async {
    try {
      final res = await dio.post<Map<String, dynamic>>(path, data: body);
      return res.data ?? {};
    } on DioException catch (e) {
      throw _translate(e);
    }
  }

  Exception _translate(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const NetworkException();
      default:
        final data = e.response?.data;
        final message = (data is Map && data['error'] is String)
            ? data['error'] as String
            : 'Erro ${e.response?.statusCode ?? "desconhecido"}';
        return ServerException(message, e.response?.statusCode);
    }
  }
}
