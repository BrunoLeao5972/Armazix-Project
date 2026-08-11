import 'package:flutter/material.dart';

/// Um único campo de busca por texto ou código de barras — um leitor USB
/// funciona como teclado, então "escanear" é só digitar rápido + Enter,
/// sem integração especial nenhuma.
class SearchBarField extends StatelessWidget {
  final ValueChanged<String> onChanged;

  const SearchBarField({super.key, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return TextField(
      onChanged: onChanged,
      decoration: const InputDecoration(
        hintText: 'Buscar por nome ou código de barras…',
        prefixIcon: Icon(Icons.search, size: 18),
        isDense: true,
      ),
    );
  }
}
