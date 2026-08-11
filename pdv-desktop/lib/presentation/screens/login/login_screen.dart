import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../cubit/auth/auth_cubit.dart';
import '../../cubit/auth/auth_state.dart';
import '../../cubit/connectivity/connectivity_cubit.dart';
import '../../widgets/login/login_illustration.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String _caixaLabel = 'Caixa 1';
  String _appVersion = '—';

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((info) {
      if (mounted) setState(() => _appVersion = info.version);
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit(BuildContext context) {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) return;
    context.read<AuthCubit>().login(email, password);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          Expanded(child: _FormPanel(
            emailController: _emailController,
            passwordController: _passwordController,
            caixaLabel: _caixaLabel,
            onCaixaLabelChanged: (v) => setState(() => _caixaLabel = v),
            appVersion: _appVersion,
            onSubmit: () => _submit(context),
          )),
          const Expanded(child: _IllustrationPanel()),
        ],
      ),
    );
  }
}

class _FormPanel extends StatelessWidget {
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final String caixaLabel;
  final ValueChanged<String> onCaixaLabelChanged;
  final String appVersion;
  final VoidCallback onSubmit;

  const _FormPanel({
    required this.emailController,
    required this.passwordController,
    required this.caixaLabel,
    required this.onCaixaLabelChanged,
    required this.appVersion,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 64, vertical: 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 10),
              const Text('Armazix PDV', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            ],
          ),
          const Spacer(),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Entrar no caixa', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                const Text(
                  'Use o mesmo login do painel Armazix. Depois do primeiro acesso, funciona sem internet.',
                  style: TextStyle(color: AppColors.inkMuted, fontSize: 13),
                ),
                const SizedBox(height: 28),
                const _FieldLabel('USUÁRIO'),
                TextField(
                  controller: emailController,
                  decoration: const InputDecoration(
                    hintText: 'seu@email.com',
                    prefixIcon: Icon(Icons.mail_outline, size: 18),
                  ),
                ),
                const SizedBox(height: 16),
                const _FieldLabel('SENHA'),
                TextField(
                  controller: passwordController,
                  obscureText: true,
                  onSubmitted: (_) => onSubmit(),
                  decoration: const InputDecoration(
                    hintText: '••••••••',
                    prefixIcon: Icon(Icons.lock_outline, size: 18),
                  ),
                ),
                const SizedBox(height: 16),
                const _FieldLabel('PERFIL / CAIXA'),
                DropdownButtonFormField<String>(
                  value: caixaLabel,
                  items: const ['Caixa 1', 'Caixa 2', 'Caixa 3', 'Balcão']
                      .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                      .toList(),
                  onChanged: (v) => onCaixaLabelChanged(v ?? caixaLabel),
                ),
                const SizedBox(height: 16),
                BlocBuilder<ConnectivityCubit, bool>(
                  builder: (context, online) {
                    if (online) return const SizedBox.shrink();
                    return const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: _Banner(
                        color: AppColors.warningBg,
                        textColor: AppColors.warning,
                        text: 'Sem conexão agora — o login vai usar os dados salvos no último acesso online deste computador.',
                      ),
                    );
                  },
                ),
                BlocBuilder<AuthCubit, AuthState>(
                  builder: (context, state) {
                    if (state is! AuthError) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _Banner(color: AppColors.dangerBg, textColor: AppColors.danger, text: state.message),
                    );
                  },
                ),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => SystemNavigator.pop(),
                        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                        child: const Text('Fechar'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: BlocBuilder<AuthCubit, AuthState>(
                        builder: (context, state) {
                          final loading = state is AuthLoading;
                          return ElevatedButton(
                            onPressed: loading ? null : onSubmit,
                            child: loading
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('Acessar'),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Spacer(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(ApiConstants.baseUrl, style: TextStyle(fontSize: 11, color: AppColors.inkMuted)),
              Row(
                children: [
                  Text('v$appVersion', style: const TextStyle(fontSize: 11, color: AppColors.inkMuted)),
                  const SizedBox(width: 12),
                  Text('© ${DateTime.now().year} Armazix', style: const TextStyle(fontSize: 11, color: AppColors.inkMuted)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _IllustrationPanel extends StatelessWidget {
  const _IllustrationPanel();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          const Positioned.fill(child: LoginIllustration()),
          Positioned(
            left: 56,
            right: 56,
            bottom: 56,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Sua loja funciona mesmo quando a internet cai.',
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(color: Colors.white, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Vendas feitas offline entram na fila e sincronizam sozinhas assim que a conexão voltar — nada fica pra trás.',
                  style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(
          text,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.inkMuted, letterSpacing: 0.4),
        ),
      );
}

class _Banner extends StatelessWidget {
  final Color color;
  final Color textColor;
  final String text;
  const _Banner({required this.color, required this.textColor, required this.text});

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)),
        child: Text(text, style: TextStyle(fontSize: 12, color: textColor)),
      );
}
