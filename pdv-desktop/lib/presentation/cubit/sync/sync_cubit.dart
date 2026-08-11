import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/network_info.dart';
import '../../../domain/repositories/order_repository.dart';
import '../../../domain/usecases/drain_sync_queue_usecase.dart';
import '../../../domain/usecases/sync_catalog_usecase.dart';
import 'sync_state.dart';

/// Fila de sincronização em background: conta pedidos pendentes em tempo
/// real, drena sozinha sempre que a conexão volta, e expõe um "sincronizar
/// agora" (catálogo + vendas) pro botão manual do header.
class SyncCubit extends Cubit<SyncState> {
  final OrderRepository orderRepository;
  final SyncCatalogUseCase syncCatalogUseCase;
  final DrainSyncQueueUseCase drainUseCase;
  final NetworkInfo networkInfo;
  final String storeId;

  StreamSubscription<int>? _pendingSub;
  late final VoidCallback _onlineListener;

  SyncCubit({
    required this.orderRepository,
    required this.syncCatalogUseCase,
    required this.drainUseCase,
    required this.networkInfo,
    required this.storeId,
  }) : super(const SyncState()) {
    _pendingSub = orderRepository.watchPendingCount(storeId).listen((count) {
      emit(state.copyWith(pendingCount: count));
    });

    _onlineListener = () {
      if (networkInfo.isOnline.value) drainUseCase();
    };
    networkInfo.isOnline.addListener(_onlineListener);
  }

  Future<void> syncNow() async {
    emit(state.copyWith(syncing: true));
    await Future.wait([syncCatalogUseCase(storeId), drainUseCase()]);
    emit(state.copyWith(syncing: false));
  }

  @override
  Future<void> close() {
    _pendingSub?.cancel();
    networkInfo.isOnline.removeListener(_onlineListener);
    return super.close();
  }
}
