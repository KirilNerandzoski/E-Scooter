export type VehicleSilhouetteKind = 'scooter' | 'ebike' | 'cargo';

export function resolveVehicleSilhouetteKind(
  vehicleName: string,
  typeName: string
): VehicleSilhouetteKind {
  const lowerName = vehicleName.toLowerCase();
  const lowerType = typeName.toLowerCase();
  if (lowerName.includes('cargo')) return 'cargo';
  if (lowerType.includes('bike') || lowerName.includes('bike') || lowerName.includes('tourer')) {
    return 'ebike';
  }
  return 'scooter';
}
