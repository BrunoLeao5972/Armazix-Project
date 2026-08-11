import 'package:dartz/dartz.dart';
import '../../core/error/exceptions.dart';
import '../../core/error/failures.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/local_password_hasher.dart';
import '../../domain/entities/user_session_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/local/session_local_datasource.dart';
import '../datasources/remote/auth_remote_datasource.dart';
import '../models/user_session_model.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remote;
  final SessionLocalDataSource local;
  final ApiClient apiClient;

  UserSessionEntity? _currentSession;

  AuthRepositoryImpl({required this.remote, required this.local, required this.apiClient});

  @override
  UserSessionEntity? get currentSession => _currentSession;

  @override
  Future<Either<Failure, UserSessionEntity>> login({
    required String email,
    required String password,
  }) async {
    try {
      final result = await remote.login(email, password);
      final hashed = await LocalPasswordHasher.hash(password);

      final session = UserSessionModel()
        ..userId = result.userId
        ..email = result.email.toLowerCase()
        ..name = result.name
        ..role = result.role
        ..storeId = result.storeId
        ..storeName = result.storeName
        ..storeSlug = result.storeSlug
        ..token = result.token
        ..userHash = hashed.hash
        ..passwordSalt = hashed.salt
        ..passwordIterations = hashed.iterations
        ..lastOnlineLoginAt = DateTime.now();

      await local.save(session);
      apiClient.setToken(result.token);

      _currentSession = session.toEntity(asOnline: true);
      return Right(_currentSession!);
    } on NetworkException {
      // status 0 (a requisição nem saiu) é o único caso em que faz sentido
      // tentar o cache local — senha errada é resposta de verdade do
      // servidor e não deve ser mascarada por um fallback silencioso.
      return _loginOffline(email, password);
    } on ServerException catch (e) {
      final isAuthError = e.statusCode == 401 || e.statusCode == 403;
      return Left(isAuthError ? AuthFailure(e.message) : ServerFailure(e.message, e.statusCode));
    }
  }

  Future<Either<Failure, UserSessionEntity>> _loginOffline(String email, String password) async {
    final cached = await local.findByEmail(email.toLowerCase());
    if (cached == null) {
      return const Left(AuthFailure(
        'Sem conexão e nenhum login anterior encontrado neste computador. '
        'Conecte-se à internet para o primeiro acesso.',
      ));
    }

    final valid = await LocalPasswordHasher.verify(
      password,
      storedHash: cached.userHash,
      storedSalt: cached.passwordSalt,
      iterations: cached.passwordIterations,
    );
    if (!valid) {
      return const Left(AuthFailure('Senha incorreta'));
    }

    // Sem token: dá pra abrir o caixa (se já houver sessão em cache) e
    // vender, mas a fila só drena de verdade depois de um login online.
    apiClient.setToken(null);
    _currentSession = cached.toEntity();
    return Right(_currentSession!);
  }

  @override
  Future<void> logout() async {
    apiClient.setToken(null);
    _currentSession = null;
  }
}
