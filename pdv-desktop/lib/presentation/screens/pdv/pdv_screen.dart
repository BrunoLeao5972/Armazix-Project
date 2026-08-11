import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

import '../../../core/di/injection.dart';
import '../../../core/utils/currency.dart';
import '../../../domain/entities/order_entity.dart';
import '../../../domain/usecases/finalize_sale_usecase.dart';
import '../../cubit/auth/auth_cubit.dart';
import '../../cubit/auth/auth_state.dart';
import '../../cubit/cart/cart_cubit.dart';
import '../../cubit/cart/cart_state.dart';
import '../../cubit/catalog/catalog_cubit.dart';
import '../../cubit/catalog/catalog_state.dart';
import '../../cubit/register/register_cubit.dart';
import '../../widgets/pdv/cart_panel.dart';
import '../../widgets/pdv/category_tabs.dart';
import '../../widgets/pdv/open_register_dialog.dart';
import '../../widgets/pdv/pdv_header.dart';
import '../../widgets/pdv/product_grid.dart';
import '../../widgets/pdv/search_bar_field.dart';

class PdvScreen extends StatefulWidget {
  const PdvScreen({super.key});

  @override
  State<PdvScreen> createState() => _PdvScreenState();
}

class _PdvScreenState extends State<PdvScreen> {
  bool _finalizing = false;
  bool _registerDialogShown = false;

  void _maybeShowOpenRegister(BuildContext context, String operatorName) {
    if (_registerDialogShown) return;
    final registerState = context.read<RegisterCubit>().state;
    if (registerState.session != null) return;
    _registerDialogShown = true;
    final registerCubit = context.read<RegisterCubit>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // showDialog empurra uma rota nova no Navigator raiz — fora da árvore
      // de widgets do PdvScreen, então o RegisterCubit (escopado à sessão em
      // _SessionScope) não chega lá sozinho. ConnectivityCubit não precisa
      // desse tratamento porque já é provido acima do MaterialApp.
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => BlocProvider.value(
          value: registerCubit,
          child: OpenRegisterDialog(operatorName: operatorName),
        ),
      ).whenComplete(() => _registerDialogShown = false);
    });
  }

  Future<void> _handleFinalize(String paymentMethod) async {
    final authState = context.read<AuthCubit>().state;
    final registerState = context.read<RegisterCubit>().state;
    if (authState is! AuthAuthenticated || registerState.session == null) return;

    setState(() => _finalizing = true);
    final cart = context.read<CartCubit>().state;
    final order = OrderEntity(
      localCode: const Uuid().v4(),
      storeId: authState.session.storeId,
      sessaoId: registerState.session!.remoteId,
      paymentMethod: paymentMethod,
      items: cart.lines
          .map((l) => OrderItemEntity(
                productId: l.productId,
                productName: l.name,
                productEmoji: l.emoji,
                quantity: l.quantity,
                unitPrice: Currency.toApiString(l.unitPrice),
                total: Currency.toApiString(l.total),
              ))
          .toList(),
      subtotal: Currency.toApiString(cart.subtotal),
      discount: cart.discount > 0 ? Currency.toApiString(cart.discount) : null,
      total: Currency.toApiString(cart.total),
      createdAt: DateTime.now(),
    );

    await getIt<FinalizeSaleUseCase>()(order);
    if (mounted) {
      context.read<CartCubit>().clear();
      setState(() => _finalizing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthCubit>().state;
    if (authState is! AuthAuthenticated) return const SizedBox.shrink();
    final session = authState.session;

    _maybeShowOpenRegister(context, session.name);

    return Scaffold(
      body: Column(
        children: [
          PdvHeader(
            storeName: session.storeName.isEmpty ? 'Armazix PDV' : session.storeName,
            operatorName: session.name,
          ),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        BlocBuilder<CatalogCubit, CatalogState>(
                          buildWhen: (a, b) => a.searchTerm != b.searchTerm,
                          builder: (context, state) => SearchBarField(
                            onChanged: (v) => context.read<CatalogCubit>().search(v),
                          ),
                        ),
                        const SizedBox(height: 12),
                        BlocBuilder<CatalogCubit, CatalogState>(
                          buildWhen: (a, b) => a.categories != b.categories || a.activeCategoryId != b.activeCategoryId,
                          builder: (context, state) => CategoryTabs(
                            categories: state.categories,
                            activeId: state.activeCategoryId,
                            onSelect: (id) => context.read<CatalogCubit>().selectCategory(id),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Expanded(
                          child: BlocBuilder<CatalogCubit, CatalogState>(
                            buildWhen: (a, b) => a.products != b.products || a.loading != b.loading,
                            builder: (context, state) {
                              if (state.loading) return const Center(child: CircularProgressIndicator());
                              return ProductGrid(
                                products: state.products,
                                onAdd: (p) => context.read<CartCubit>().addProduct(p),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                BlocBuilder<CartCubit, CartState>(
                  builder: (context, cart) => CartPanel(cart: cart, finalizing: _finalizing, onFinalize: _handleFinalize),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
