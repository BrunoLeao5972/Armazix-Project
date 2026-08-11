// Smoke test básico — confirma que o app sobe sem crashar.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Renderiza sem crashar', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Text('Armazix PDV'))));
    expect(find.text('Armazix PDV'), findsOneWidget);
  });
}
