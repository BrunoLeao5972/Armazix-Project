import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'core/di/injection.dart';
import 'core/network/network_info.dart';
import 'core/theme/app_theme.dart';
import 'domain/entities/user_session_entity.dart';
import 'domain/repositories/catalog_repository.dart';
import 'domain/repositories/caixa_repository.dart';
import 'domain/repositories/order_repository.dart';
import 'domain/usecases/drain_sync_queue_usecase.dart';
import 'domain/usecases/login_usecase.dart';
import 'domain/usecases/logout_usecase.dart';
import 'domain/usecases/open_register_usecase.dart';
import 'domain/usecases/sync_catalog_usecase.dart';
import 'presentation/cubit/auth/auth_cubit.dart';
import 'presentation/cubit/auth/auth_state.dart';
import 'presentation/cubit/cart/cart_cubit.dart';
import 'presentation/cubit/catalog/catalog_cubit.dart';
import 'presentation/cubit/connectivity/connectivity_cubit.dart';
import 'presentation/cubit/register/register_cubit.dart';
import 'presentation/cubit/sync/sync_cubit.dart';
import 'presentation/screens/login/login_screen.dart';
import 'presentation/screens/pdv/pdv_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await setupDependencyInjection();
  runApp(const ArmazixPdvApp());
}

class ArmazixPdvApp extends StatelessWidget {
  const ArmazixPdvApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => ConnectivityCubit(getIt())),
        BlocProvider(
          create: (_) => AuthCubit(
            loginUseCase: getIt<LoginUseCase>(),
            logoutUseCase: getIt<LogoutUseCase>(),
            syncCatalogUseCase: getIt<SyncCatalogUseCase>(),
          ),
        ),
      ],
      child: MaterialApp(
        title: 'Armazix PDV',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: const _RootShell(),
      ),
    );
  }
}

class _RootShell extends StatelessWidget {
  const _RootShell();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, state) {
        if (state is AuthAuthenticated) {
          return _SessionScope(session: state.session, child: const PdvScreen());
        }
        return const LoginScreen();
      },
    );
  }
}

/// Cubits que só existem depois do login, escopados ao storeId da sessão.
/// A key força recriar tudo se um usuário de outra loja logar em seguida
/// (logout → login), sem carregar estado da sessão anterior.
class _SessionScope extends StatelessWidget {
  final UserSessionEntity session;
  final Widget child;

  const _SessionScope({required this.session, required this.child});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      key: ValueKey(session.storeId),
      providers: [
        BlocProvider(create: (_) => CatalogCubit(repository: getIt<CatalogRepository>(), storeId: session.storeId)),
        BlocProvider(create: (_) => CartCubit()),
        BlocProvider(
          create: (_) => SyncCubit(
            orderRepository: getIt<OrderRepository>(),
            syncCatalogUseCase: getIt<SyncCatalogUseCase>(),
            drainUseCase: getIt<DrainSyncQueueUseCase>(),
            networkInfo: getIt<NetworkInfo>(),
            storeId: session.storeId,
          ),
        ),
        BlocProvider(
          create: (_) => RegisterCubit(
            openRegisterUseCase: getIt<OpenRegisterUseCase>(),
            caixaRepository: getIt<CaixaRepository>(),
          ),
        ),
      ],
      child: child,
    );
  }
}
