import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:get_it/get_it.dart';
import 'package:isar/isar.dart';

import '../../data/datasources/local/caixa_local_datasource.dart';
import '../../data/datasources/local/category_local_datasource.dart';
import '../../data/datasources/local/order_local_datasource.dart';
import '../../data/datasources/local/product_local_datasource.dart';
import '../../data/datasources/local/session_local_datasource.dart';
import '../../data/datasources/remote/auth_remote_datasource.dart';
import '../../data/datasources/remote/catalog_remote_datasource.dart';
import '../../data/datasources/remote/pdv_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../data/repositories/caixa_repository_impl.dart';
import '../../data/repositories/catalog_repository_impl.dart';
import '../../data/repositories/order_repository_impl.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/repositories/caixa_repository.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../domain/repositories/order_repository.dart';
import '../../domain/usecases/drain_sync_queue_usecase.dart';
import '../../domain/usecases/finalize_sale_usecase.dart';
import '../../domain/usecases/login_usecase.dart';
import '../../domain/usecases/logout_usecase.dart';
import '../../domain/usecases/open_register_usecase.dart';
import '../../domain/usecases/sync_catalog_usecase.dart';
import '../db/isar_service.dart';
import '../network/api_client.dart';
import '../network/network_info.dart';

final getIt = GetIt.instance;

/// Monta o grafo de dependências uma vez, na inicialização do app (main.dart).
/// Repositórios/usecases são singletons — o app inteiro roda numa janela só,
/// sem necessidade de escopo por rota.
Future<void> setupDependencyInjection() async {
  final isar = await IsarService.open();
  getIt.registerSingleton<Isar>(isar);
  getIt.registerSingleton<ApiClient>(ApiClient());
  getIt.registerSingleton<NetworkInfo>(NetworkInfoImpl(Connectivity()));

  getIt.registerLazySingleton<AuthRemoteDataSource>(() => AuthRemoteDataSourceImpl(getIt()));
  getIt.registerLazySingleton<CatalogRemoteDataSource>(() => CatalogRemoteDataSourceImpl(getIt()));
  getIt.registerLazySingleton<PdvRemoteDataSource>(() => PdvRemoteDataSourceImpl(getIt()));

  getIt.registerLazySingleton<SessionLocalDataSource>(() => SessionLocalDataSourceImpl(getIt()));
  getIt.registerLazySingleton<ProductLocalDataSource>(() => ProductLocalDataSourceImpl(getIt()));
  getIt.registerLazySingleton<CategoryLocalDataSource>(() => CategoryLocalDataSourceImpl(getIt()));
  getIt.registerLazySingleton<OrderLocalDataSource>(() => OrderLocalDataSourceImpl(getIt()));
  getIt.registerLazySingleton<CaixaLocalDataSource>(() => CaixaLocalDataSourceImpl(getIt()));

  getIt.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(remote: getIt(), local: getIt(), apiClient: getIt()),
  );
  getIt.registerLazySingleton<CatalogRepository>(
    () => CatalogRepositoryImpl(remote: getIt(), productLocal: getIt(), categoryLocal: getIt()),
  );
  getIt.registerLazySingleton<OrderRepository>(
    () => OrderRepositoryImpl(local: getIt(), remote: getIt(), networkInfo: getIt()),
  );

  // CaixaRepository precisa carregar o turno em cache ANTES da UI decidir se
  // mostra o diálogo de abrir caixa — por isso é resolvido (não lazy) aqui.
  final caixaRepository = CaixaRepositoryImpl(remote: getIt(), local: getIt());
  await caixaRepository.loadCached();
  getIt.registerSingleton<CaixaRepository>(caixaRepository);

  getIt.registerFactory(() => LoginUseCase(getIt()));
  getIt.registerFactory(() => LogoutUseCase(getIt()));
  getIt.registerFactory(() => SyncCatalogUseCase(getIt()));
  getIt.registerFactory(() => FinalizeSaleUseCase(getIt()));
  getIt.registerFactory(() => DrainSyncQueueUseCase(getIt()));
  getIt.registerFactory(() => OpenRegisterUseCase(getIt()));
}
