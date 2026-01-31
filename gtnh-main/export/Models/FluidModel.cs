using Source;

public class FluidModel
{
    [SchemaName("ID")]
    public string Id { get; set; }

    [SchemaName("DENSITY")]
    public int Density { get; set; }

    [SchemaName("FLUID_ID")]
    public int FluidId { get; set; }

    [SchemaName("GASEOUS")]
    public bool Gaseous { get; set; }

    [SchemaName("IMAGE_FILE_PATH")]
    public string ImageFilePath { get; set; }

    [SchemaName("INTERNAL_NAME")]
    public string InternalName { get; set; }

    [SchemaName("LOCALIZED_NAME")]
    public string LocalizedName { get; set; }

    [SchemaName("LUMINOSITY")]
    public int Luminosity { get; set; }

    [SchemaName("MOD_ID")]
    public string ModId { get; set; }

    [SchemaName("NBT")]
    public string Nbt { get; set; }

    [SchemaName("TEMPERATURE")]
    public int Temperature { get; set; }

    [SchemaName("UNLOCALIZED_NAME")]
    public string UnlocalizedName { get; set; }

    [SchemaName("VISCOSITY")]
    public int Viscosity { get; set; }
}

public class FluidBlockModel
{
    [SchemaName("ID")]
    public string Id { get; set; }

    [SchemaName("BLOCK_ID")]
    public string BlockId { get; set; }

    [SchemaName("FLUID_ID")]
    public string FluidId { get; set; }
}

public class FluidContainerModel
{
    [SchemaName("ID")]
    public string Id { get; set; }

    [SchemaName("FLUID_STACK_AMOUNT")]
    public int FluidStackAmount { get; set; }

    [SchemaName("CONTAINER_ID")]
    public string ContainerId { get; set; }

    [SchemaName("EMPTY_CONTAINER_ID")]
    public string EmptyContainerId { get; set; }

    [SchemaName("FLUID_STACK_FLUID_ID")]
    public string FluidStackFluidId { get; set; }
}

public class FluidGroupFluidStacksModel
{
    [SchemaName("FLUID_GROUP_ID")]
    public string FluidGroupId { get; set; }

    [SchemaName("FLUID_STACKS_AMOUNT")]
    public int FluidStacksAmount { get; set; }

    [SchemaName("FLUID_STACKS_FLUID_ID")]
    public string FluidStacksFluidId { get; set; }
}

public class FluidGroupModel
{
    [SchemaName("ID")]
    public string Id { get; set; }
}