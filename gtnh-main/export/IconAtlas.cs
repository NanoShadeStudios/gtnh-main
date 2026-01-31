public static class IconAtlas
{
    public const int ImageSize = 64;
    public const int DimensionBits = 8;
    public const int XMask = (1 << DimensionBits) - 1;
    public const int YMask = XMask << DimensionBits;
    public const int XYMask = XMask | YMask;
    public const int TextureSize = (1 << DimensionBits) * ImageSize;
    public const int SpritesPerPage = 1 << (DimensionBits * 2);
}