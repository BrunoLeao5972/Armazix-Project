import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';
import '../entities/user_session_entity.dart';
import '../repositories/auth_repository.dart';

class LoginUseCase {
  final AuthRepository repository;
  const LoginUseCase(this.repository);

  Future<Either<Failure, UserSessionEntity>> call({
    required String email,
    required String password,
  }) {
    if (email.trim().isEmpty || password.isEmpty) {
      return Future.value(const Left(ValidationFailure('Informe usuário e senha')));
    }
    return repository.login(email: email.trim(), password: password);
  }
}
