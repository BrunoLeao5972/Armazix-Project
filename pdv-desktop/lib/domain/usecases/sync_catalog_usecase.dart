import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';
import '../repositories/catalog_repository.dart';

class SyncCatalogUseCase {
  final CatalogRepository repository;
  const SyncCatalogUseCase(this.repository);

  Future<Either<Failure, CatalogSyncResult>> call(String storeId) => repository.syncCatalog(storeId);
}
