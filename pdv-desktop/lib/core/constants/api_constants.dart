/// Endpoints da API Cloud do Armazix consumidos pelo PDV desktop.
///
/// Todos já existem em produção (armazix.com.br) — o app fala com o MESMO
/// backend do painel admin e da vitrine, autenticado via Bearer token
/// (`/api/auth/login-desktop`, que devolve o JWT no corpo em vez de cookie,
/// porque o app não é o mesmo "site" pra fins de SameSite).
class ApiConstants {
  ApiConstants._();

  /// Override em build/run com `--dart-define=API_BASE_URL=http://localhost:8787`
  /// pra apontar pro backend local (`npm run deploy:dev` no projeto raiz).
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://armazix.com.br',
  );

  static const String loginDesktop = '/api/auth/login-desktop';
  static const String health = '/api/health';
  static const String productsListAdmin = '/api/products/list-admin';
  static const String categoriesListAdmin = '/api/categories/list-admin';
  static const String abrirCaixa = '/api/pdv/caixa/abrir';
  static const String finalizarVenda = '/api/pdv/finalizar-venda';
}
