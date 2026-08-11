import 'package:dartz/dartz.dart';
import '../../core/error/exceptions.dart';
import '../../core/error/failures.dart';
import '../../domain/entities/caixa_session_entity.dart';
import '../../domain/repositories/caixa_repository.dart';
import '../datasources/local/caixa_local_datasource.dart';
import '../datasources/remote/pdv_remote_datasource.dart';
import '../models/caixa_session_model.dart';

class CaixaRepositoryImpl implements CaixaRepository {
  final PdvRemoteDataSource remote;
  final CaixaLocalDataSource local;

  CaixaSessionEntity? _cached;

  CaixaRepositoryImpl({required this.remote, required this.local});

  @override
  CaixaSessionEntity? get cachedSession => _cached;

  /// Chamado uma vez, no bootstrap do app — carrega o turno em aberto (se
  /// houver) antes da UI decidir se mostra o diálogo de abrir caixa.
  Future<void> loadCached() async {
    final model = await local.current();
    _cached = model?.toEntity();
  }

  @override
  Future<Either<Failure, CaixaSessionEntity>> openRegister({
    required String saldoInicial,
    String? abertoPor,
  }) async {
    try {
      final result = await remote.abrirCaixa(saldoInicial: saldoInicial, abertoPor: abertoPor);
      final model = CaixaSessionModel()
        ..remoteId = result.sessaoId
        ..saldoInicial = result.saldoInicial
        ..openedAt = DateTime.now();
      await local.save(model);
      _cached = model.toEntity();
      return Right(_cached!);
    } on NetworkException {
      return const Left(NetworkFailure(
        'Sem conexão — é preciso abrir o caixa online pelo menos uma vez '
        'neste computador antes do primeiro turno offline.',
      ));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, e.statusCode));
    }
  }
}
