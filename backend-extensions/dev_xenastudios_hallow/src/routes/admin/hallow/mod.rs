use shared::State;
use utoipa_axum::router::OpenApiRouter;

mod fleet;
mod instances;
mod kinds;
mod network;
mod players;
mod punishments;
mod ranks;
mod signals;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/fleet", fleet::router(state))
        .nest("/instances", instances::router(state))
        .nest("/kinds", kinds::router(state))
        .nest("/network", network::router(state))
        .nest("/players", players::router(state))
        .nest("/punishments", punishments::router(state))
        .nest("/ranks", ranks::router(state))
        .nest("/signals", signals::router(state))
        .with_state(state.clone())
}
