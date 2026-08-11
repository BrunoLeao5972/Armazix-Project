import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';
import '../entities/caixa_session_entity.dart';
import '../repositories/caixa_repository.dart';

class OpenRegisterUseCase {
  final CaixaRepository repository;
  const OpenRegisterUseCase(this.repository);

  Future<Either<Failure, CaixaSessionEntity>> call({
    required String saldoInicial,
    String? abertoPor,
  }) =>
      repository.openRegister(saldoInicial: saldoInicial, abertoPor: abertoPor);
}
