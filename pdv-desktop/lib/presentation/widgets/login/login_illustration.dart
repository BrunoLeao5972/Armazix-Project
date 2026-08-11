import 'package:flutter/material.dart';

/// Ilustração abstrata (pontos de mapa + manchas suaves) — placeholder até
/// termos a arte final da marca. Desenhada em Canvas puro, sem asset.
class LoginIllustration extends StatelessWidget {
  const LoginIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _MapDotsPainter(), child: const SizedBox.expand());
  }
}

class _MapDotsPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final dotPaint = Paint()..color = Colors.white.withValues(alpha: 0.18);
    const spacing = 48.0;
    for (double y = 40; y < size.height; y += spacing) {
      for (double x = 30; x < size.width; x += spacing) {
        canvas.drawCircle(Offset(x, y), 1.6, dotPaint);
      }
    }

    canvas.drawCircle(
      Offset(size.width * 0.45, size.height * 0.38),
      90,
      Paint()..color = Colors.white.withValues(alpha: 0.06),
    );
    canvas.drawCircle(
      Offset(size.width * 0.65, size.height * 0.6),
      130,
      Paint()..color = Colors.white.withValues(alpha: 0.05),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
