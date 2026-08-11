/// Exceptions técnicas lançadas pelas camadas datasource/rede — traduzidas
/// em [Failure] pelos repositórios antes de chegar no domínio/UI.
class ServerException implements Exception {
  final String message;
  final int? statusCode;
  const ServerException(this.message, [this.statusCode]);
}

class NetworkException implements Exception {
  const NetworkException();
}

class CacheException implements Exception {
  final String message;
  const CacheException(this.message);
}
