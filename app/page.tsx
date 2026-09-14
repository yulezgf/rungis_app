export default function Home() {
  const products = [
    { name: "Côte de bœuf", qty: "10" },
    { name: "Poulet entier", qty: "5" },
    { name: "Saucisse toulouse", qty: "8" },
  ];

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Bon de commande — [Ton nom]</h1>
      <ul className="space-y-2">
        {products.map((p) => (
          <li key={p.name} className="flex justify-between border-b pb-2">
            <span>{p.name}</span>
            <span className="text-gray-500">{p.qty}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}