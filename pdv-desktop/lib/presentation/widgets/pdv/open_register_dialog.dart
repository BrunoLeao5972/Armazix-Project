import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme/app_colors.dart';
import '../../cubit/connectivity/connectivity_cubit.dart';
import '../../cubit/register/register_cubit.dart';
import '../../cubit/register/register_state.dart';

/// Turno de caixa — a API só sabe abrir sessão online, então o primeiro
/// turno de cada computador exige conexão. Turnos seguintes reaproveitam a
/// última sessão em cache (ver CaixaRepositoryImpl.loadCached).
class OpenRegisterDialog extends StatefulWidget {
  final String operatorName;
  const OpenRegisterDialog({super.key, required this.operatorName});

  @override
  State<OpenRegisterDialog> createState() => _OpenRegisterDialogState();
}

class _OpenRegisterDialogState extends State<OpenRegisterDialog> {
  final _saldoController = TextEditingController(text: '0,00');

  @override
  void dispose() {
    _saldoController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<RegisterCubit, RegisterState>(
      listener: (context, state) {
        if (state.session != null && !state.loading) {
          Navigator.of(context).pop();
        }
      },
      builder: (context, state) {
        final online = context.watch<ConnectivityCubit>().state;
        return PopScope(
          canPop: false,
          child: Dialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
                          child: const Icon(Icons.account_balance_wallet_outlined, color: AppColors.primary),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Abrir caixa', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            Text('Turno de ${widget.operatorName}', style: const TextStyle(fontSize: 12, color: AppColors.inkMuted)),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    if (!online)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 16),
                        child: _Banner(
                          text: 'Sem conexão — é preciso abrir o caixa online pelo menos uma vez neste '
                              'computador antes do primeiro turno offline.',
                        ),
                      ),
                    const Text('SALDO INICIAL (R\$)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.inkMuted)),
                    const SizedBox(height: 6),
                    TextField(controller: _saldoController, enabled: online, keyboardType: TextInputType.number),
                    if (state.error != null) ...[
                      const SizedBox(height: 12),
                      _Banner(text: state.error!, color: AppColors.dangerBg, textColor: AppColors.danger),
                    ],
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: (!online || state.loading)
                          ? null
                          : () => context.read<RegisterCubit>().open(
                                _saldoController.text.replaceAll(',', '.'),
                                abertoPor: widget.operatorName,
                              ),
                      child: state.loading
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Abrir caixa e começar a vender'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Banner extends StatelessWidget {
  final String text;
  final Color color;
  final Color textColor;
  const _Banner({required this.text, this.color = AppColors.warningBg, this.textColor = AppColors.warning});

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)),
        child: Text(text, style: TextStyle(fontSize: 12, color: textColor)),
      );
}
