import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';
import '../entities/user_session_entity.dart';

abstract class AuthRepository {
  /// Login online-primeiro-depois-offline: tenta a API; se a rede falhar
  /// (não outros erros — senha errada é erro de verdade), cai pro cache local.
  Future<Either<Failure, UserSessionEntity>> login({
    required String email,
    required String password,
  });

  Future<void> logout();

  /// Sessão salva do último login bem-sucedido (online ou offline), se houver.
  UserSessionEntity? get currentSession;
}
