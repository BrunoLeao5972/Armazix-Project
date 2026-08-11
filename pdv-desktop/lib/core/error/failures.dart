/// Falhas de domínio — o que a UI decide mostrar. As camadas data/repositório
/// traduzem exceptions técnicas (DioException, IsarError) pra esses tipos
/// antes de cruzar a fronteira do domínio.
sealed class Failure {
  final String message;
  const Failure(this.message);
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'Sem conexão com o servidor']);
}

class AuthFailure extends Failure {
  const AuthFailure(super.message);
}

class ServerFailure extends Failure {
  final int? statusCode;
  const ServerFailure(super.message, [this.statusCode]);
}

class CacheFailure extends Failure {
  const CacheFailure(super.message);
}

class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}
