import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';

class AbrirCaixaResult {
  final String sessaoId;
  final String saldoInicial;
  const AbrirCaixaResult({required this.sessaoId, required this.saldoInicial});
}

class FinalizarVendaResult {
  final String orderId;
  final int number;
  const FinalizarVendaResult({required this.orderId, required this.number});
}

abstract class PdvRemoteDataSource {
  Future<AbrirCaixaResult> abrirCaixa({required String saldoInicial, String? abertoPor});
  Future<FinalizarVendaResult> finalizarVenda(Map<String, dynamic> payload);
}

class PdvRemoteDataSourceImpl implements PdvRemoteDataSource {
  final ApiClient client;
  const PdvRemoteDataSourceImpl(this.client);

  @override
  Future<AbrirCaixaResult> abrirCaixa({required String saldoInicial, String? abertoPor}) async {
    final data = await client.post(ApiConstants.abrirCaixa, {
      'saldoInicial': saldoInicial,
      if (abertoPor != null) 'abertoPor': abertoPor,
      // Diferencia de um caixa aberto pelo painel web — a API bloqueia dois
      // turnos simultâneos por loja e avisa de qual canal veio o outro.
      'origem': 'desktop',
    });
    final sessao = data['sessao'] as Map<String, dynamic>;
    return AbrirCaixaResult(
      sessaoId: sessao['id'] as String,
      saldoInicial: sessao['saldoInicial'] as String,
    );
  }

  @override
  Future<FinalizarVendaResult> finalizarVenda(Map<String, dynamic> payload) async {
    final data = await client.post(ApiConstants.finalizarVenda, payload);
    final order = data['order'] as Map<String, dynamic>;
    return FinalizarVendaResult(orderId: order['id'] as String, number: order['number'] as int);
  }
}
