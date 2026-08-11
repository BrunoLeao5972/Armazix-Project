import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';
import '../entities/caixa_session_entity.dart';

abstract class CaixaRepository {
  CaixaSessionEntity? get cachedSession;

  Future<Either<Failure, CaixaSessionEntity>> openRegister({
    required String saldoInicial,
    String? abertoPor,
  });
}
