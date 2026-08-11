import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme/app_colors.dart';
import '../../cubit/auth/auth_cubit.dart';
import '../../cubit/connectivity/connectivity_cubit.dart';
import '../../cubit/sync/sync_cubit.dart';
import '../../cubit/sync/sync_state.dart';

class PdvHeader extends StatelessWidget {
  final String storeName;
  final String operatorName;

  const PdvHeader({super.key, required this.storeName, required this.operatorName});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: AppColors.border))),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(storeName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14), overflow: TextOverflow.ellipsis),
                Text('Operador: $operatorName', style: const TextStyle(fontSize: 12, color: AppColors.inkMuted)),
              ],
            ),
          ),
          BlocBuilder<SyncCubit, SyncState>(
            builder: (context, sync) {
              if (sync.pendingCount == 0) return const SizedBox.shrink();
              final plural = sync.pendingCount > 1 ? 's' : '';
              return Container(
                margin: const EdgeInsets.only(right: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.warningBg,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
                ),
                child: Text(
                  '${sync.pendingCount} venda$plural pendente$plural',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.warning),
                ),
              );
            },
          ),
          BlocBuilder<ConnectivityCubit, bool>(
            builder: (context, online) {
              return Container(
                margin: const EdgeInsets.only(right: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: online ? AppColors.primaryLight : AppColors.warningBg,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(online ? Icons.wifi : Icons.wifi_off, size: 14, color: online ? AppColors.primaryDark : AppColors.warning),
                    const SizedBox(width: 6),
                    Text(
                      online ? 'Online' : 'Offline',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: online ? AppColors.primaryDark : AppColors.warning),
                    ),
                  ],
                ),
              );
            },
          ),
          BlocBuilder<SyncCubit, SyncState>(
            builder: (context, sync) => IconButton(
              tooltip: 'Sincronizar agora',
              onPressed: sync.syncing ? null : () => context.read<SyncCubit>().syncNow(),
              icon: sync.syncing
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.sync, size: 18),
            ),
          ),
          IconButton(
            tooltip: 'Sair',
            onPressed: () => context.read<AuthCubit>().logout(),
            icon: const Icon(Icons.logout, size: 18),
          ),
        ],
      ),
    );
  }
}
