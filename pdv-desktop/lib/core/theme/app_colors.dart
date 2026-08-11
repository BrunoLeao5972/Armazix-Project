import 'package:flutter/material.dart';

/// Mesma identidade visual do Armazix (armazix.com.br) — verde como cor
/// primária. Paleta própria deste app porque o Flutter não compartilha
/// tokens de design com o painel web (React/Tailwind).
class AppColors {
  AppColors._();

  static const primary = Color(0xFF00C853);
  static const primaryDark = Color(0xFF00A846);
  static const primaryLight = Color(0xFFE8FBF0);
  static const surface = Color(0xFFF7F8FA);
  static const ink = Color(0xFF0F172A);
  static const inkMuted = Color(0x990F172A);
  static const border = Color(0x1A0F172A);
  static const danger = Color(0xFFDC2626);
  static const dangerBg = Color(0xFFFEF2F2);
  static const warning = Color(0xFFB45309);
  static const warningBg = Color(0xFFFFFBEB);
}
