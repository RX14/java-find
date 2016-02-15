class PrintJavaVersion {
    public static void main(String[] args) {
        System.out.print(System.getProperty("java.version") + "\n");
        System.out.print(System.getProperty("sun.arch.data.model"));
    }
}
